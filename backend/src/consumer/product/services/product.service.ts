import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from '../dtos/create-product-branch.dto';
import { UpdateEntityDto } from '../dtos/update-entity.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prismaService: PrismaService) {}

  // Create product with updated tag handling
  async createProduct(createProductDto: CreateProductDto) {
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

    // Create the product with relations
    const product = await this.prismaService.product.create({
      data: {
        ...productData,
        category: { connect: { id: category_id } },
        brand: { connect: { id: brand_id } },
        unit: { connect: { id: product_unit_id } },
        ...(sale_unit_id
          ? { sale_unit: { connect: { id: sale_unit_id } } }
          : {}),
        ...(purchase_unit_id
          ? { purchase_unit: { connect: { id: purchase_unit_id } } }
          : {}),
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

    return this.getProduct(product.id);
  }

  // Get a single product with updated tag handling
  async getProduct(id: number) {
    const product = await this.prismaService.product.findUnique({
      where: { id },
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
  async updateProduct(id: number, updateProductDto: Partial<CreateProductDto>) {
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
      ...productData
    } = updateProductDto;

    // Check if product exists
    const existingProduct = await this.prismaService.product.findUnique({
      where: { id },
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

    // Update the product
    const updatedProduct = await this.prismaService.product.update({
      where: { id },
      data: updateData,
    });

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

    return this.getProduct(id);
  }

  // Get product tags with the updated many-to-many relationship
  async getProductTags(productId: number) {
    const productTags = await this.prismaService.productTag.findMany({
      where: { product_id: productId },
      include: { tag: true },
    });

    return productTags.map((pt) => ({
      id: pt.tag_id,
      name: pt.tag.name,
    }));
  }

  // Add a tag to a product with the updated many-to-many relationship
  async addProductTag(productId: number, tagName: string) {
    // Find or create the tag
    let tag = await this.prismaService.tag.findFirst({
      where: { name: tagName },
    });

    if (!tag) {
      tag = await this.prismaService.tag.create({
        data: { name: tagName },
      });
    }

    // Check if the relationship already exists
    const existingRelation = await this.prismaService.productTag.findFirst({
      where: {
        product_id: productId,
        tag_id: tag.id,
      },
    });

    if (existingRelation) {
      return { id: tag.id, name: tag.name };
    }

    // Create the relationship
    await this.prismaService.productTag.create({
      data: {
        product_id: productId,
        tag_id: tag.id,
      },
    });

    return { id: tag.id, name: tag.name };
  }

  // Remove a tag from a product with the updated many-to-many relationship
  async removeProductTag(productId: number, tagId: number) {
    await this.prismaService.productTag.delete({
      where: {
        product_id_tag_id: {
          product_id: productId,
          tag_id: tagId,
        },
      },
    });

    return { success: true };
  }

  // Get all tags (updated to use the new tag model)
  async getTags() {
    return this.prismaService.tag.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Create a tag (updated to use the new tag model)
  async createTag(tagData: string) {
    return this.prismaService.tag.create({
      data: { name: tagData },
    });
  }

  // Update a tag (updated to use the new tag model)
  async updateTag(id: number, name: string) {
    return this.prismaService.tag.update({
      where: { id },
      data: { name }, // Support both field names for flexibility
    });
  }

  // Delete a tag (updated to use the new tag model)
  async deleteTag(id: number) {
    // This will automatically delete all product_tag relations due to onDelete: Cascade
    await this.prismaService.tag.delete({
      where: { id },
    });

    return { success: true };
  }

  // Other methods remain the same but update references to model names if needed
  async deleteProduct(id: number) {
    // Check if product exists
    const product = await this.prismaService.product.findUnique({
      where: { id },
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

  async getVariants(productId: number) {
    return this.prismaService.productVariant.findMany({
      where: { product_id: productId },
    });
  }

  async createVariant(productId: number, variantData: any) {
    return this.prismaService.productVariant.create({
      data: {
        ...variantData,
        product: { connect: { id: productId } },
      },
    });
  }

  async updateVariant(id: number, variantData: any) {
    return this.prismaService.productVariant.update({
      where: { id },
      data: variantData,
    });
  }

  async deleteVariant(id: number) {
    await this.prismaService.productVariant.delete({
      where: { id },
    });
    return { success: true };
  }

  async getBranchPrices(productId: number) {
    return this.prismaService.productBranchPrice.findMany({
      where: { product_id: productId },
      include: { branch: true },
    });
  }

  async createBranchPrice(productId: number, branchPriceData: any) {
    return this.prismaService.productBranchPrice.create({
      data: {
        price: branchPriceData.price,
        product: { connect: { id: productId } },
        branch: { connect: { id: branchPriceData.branch_id } },
      },
      include: { branch: true },
    });
  }

  async updateBranchPrice(id: number, branchPriceData: any) {
    return this.prismaService.productBranchPrice.update({
      where: { id },
      data: {
        price: branchPriceData.price,
        ...(branchPriceData.branch_id
          ? { branch: { connect: { id: branchPriceData.branch_id } } }
          : {}),
      },
      include: { branch: true },
    });
  }

  async deleteBranchPrice(id: number) {
    await this.prismaService.productBranchPrice.delete({
      where: { id },
    });
    return { success: true };
  }

  async getSerials(productId: number) {
    return this.prismaService.productSerial.findMany({
      where: { product_id: productId },
    });
  }

  async createSerial(productId: number, serial: string) {
    return this.prismaService.productSerial.create({
      data: {
        serial,
        product: { connect: { id: productId } },
      },
    });
  }

  async updateSerial(id: number, serial: string) {
    return this.prismaService.productSerial.update({
      where: { id },
      data: { serial },
    });
  }

  async deleteSerial(id: number) {
    await this.prismaService.productSerial.delete({
      where: { id },
    });
    return { success: true };
  }

  async getPromotionalPrice(productId: number) {
    return this.prismaService.promotionalPrice.findFirst({
      where: { product_id: productId },
    });
  }

  async createPromotionalPrice(productId: number, promoData: any) {
    // Delete any existing promotional price
    await this.prismaService.promotionalPrice.deleteMany({
      where: { product_id: productId },
    });

    return this.prismaService.promotionalPrice.create({
      data: {
        price: promoData.price,
        starts_at: promoData.starts_at,
        ends_at: promoData.ends_at,
        product: { connect: { id: productId } },
      },
    });
  }

  async updatePromotionalPrice(productId: number, promoData: any) {
    const existingPromo = await this.prismaService.promotionalPrice.findFirst({
      where: { product_id: productId },
    });

    if (!existingPromo) {
      return this.createPromotionalPrice(productId, promoData);
    }

    return this.prismaService.promotionalPrice.update({
      where: { id: existingPromo.id },
      data: promoData,
    });
  }

  async deletePromotionalPrice(productId: number) {
    await this.prismaService.promotionalPrice.deleteMany({
      where: { product_id: productId },
    });
    return { success: true };
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

  async getBranches() {
    return this.prismaService.branch.findMany();
  }

  async getCategories() {
    return this.prismaService.category.findMany();
  }

  async getBrands() {
    return this.prismaService.brand.findMany();
  }

  async getUnits() {
    return this.prismaService.unit.findMany();
  }

  async updateBrand(id: number, name: string) {
    return this.prismaService.brand.update({
      where: { id },
      data: { name },
    });
  }

  async updateCategory(id: number, name: string) {
    return this.prismaService.category.update({
      where: { id },
      data: { name },
    });
  }

  async updateUnit(id: number, name: string) {
    return this.prismaService.unit.update({
      where: { id },
      data: { name },
    });
  }

  async updateBranch(id: number, name: string) {
    return this.prismaService.branch.update({
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

  async deleteCategory(id: number) {
    await this.prismaService.category.delete({
      where: { id },
    });
    return { success: true };
  }

  async deleteUnit(id: number) {
    await this.prismaService.unit.delete({
      where: { id },
    });
    return { success: true };
  }

  async deleteBranch(id: number) {
    await this.prismaService.branch.delete({
      where: { id },
    });
    return { success: true };
  }
}
