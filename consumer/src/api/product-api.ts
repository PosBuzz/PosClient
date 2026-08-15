import {
  Brand,
  Category,
  Product,
  ProductFormData,
  ProductListResponse,
  Tag,
  Unit,
} from "../types/product.types";
import { deleteApi, get, patch, post } from "./crud-api";
import { endpoints } from "./endpoints";

export const productApi = {
  // Product CRUD operations
  getProducts: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryIds?: number[];
    brandIds?: number[];
    tagIds?: number[];
  }): Promise<ProductListResponse> => {
    const formattedParams = { ...params };

    if (params.categoryIds?.length) {
      formattedParams.categoryIds = params.categoryIds.join(",") as any;
    }
    if (params.brandIds?.length) {
      formattedParams.brandIds = params.brandIds.join(",") as any;
    }
    if (params.tagIds?.length) {
      formattedParams.tagIds = params.tagIds.join(",") as any;
    }

    return get(endpoints.products, formattedParams);
  },

  // Plan-imposed product cap for this tenant (max_products = null → unlimited)
  getProductLimit: async (): Promise<{
    plan_name: string | null;
    max_products: number | null;
    used: number;
    remaining: number | null;
    limit_reached: boolean;
  }> => {
    return get(endpoints.productLimit);
  },

  getProduct: async (id: number): Promise<Product> => {
    return get(endpoints.getProduct(id));
  },

  createProduct: async (productData: ProductFormData): Promise<Product> => {
    return post(endpoints.products, productData);
  },

  updateProduct: async (
    id: number,
    productData: Partial<ProductFormData>,
  ): Promise<Product> => {
    return patch(endpoints.updateProduct(id), productData);
  },

  deleteProduct: async (id: number): Promise<void> => {
    return deleteApi(endpoints.deleteProduct(id));
  },

  // Master data operations - Categories
  getCategories: async (): Promise<Category[]> => {
    return get(endpoints.getCategories);
  },

  createCategory: async (name: string): Promise<Category> => {
    return post(endpoints.createCategory, { name });
  },

  updateCategory: async (id: number, name: string): Promise<Category> => {
    return patch(endpoints.updateCategory(id), { name });
  },

  deleteCategory: async (id: number): Promise<void> => {
    return deleteApi(endpoints.deleteCategory(id));
  },

  // Master data operations - Brands
  getBrands: async (): Promise<Brand[]> => {
    return get(endpoints.getBrands);
  },

  createBrand: async (name: string): Promise<Brand> => {
    return post(endpoints.createBrand, { name });
  },

  updateBrand: async (id: number, name: string): Promise<Brand> => {
    return patch(endpoints.updateBrand(id), { name });
  },

  deleteBrand: async (id: number): Promise<void> => {
    return deleteApi(endpoints.deleteBrand(id));
  },

  // Master data operations - Units
  getUnits: async (): Promise<Unit[]> => {
    return get(endpoints.getUnits);
  },

  createUnit: async (name: string): Promise<Unit> => {
    return post(endpoints.createUnit, { name });
  },

  updateUnit: async (id: number, name: string): Promise<Unit> => {
    return patch(endpoints.updateUnit(id), { name });
  },

  deleteUnit: async (id: number): Promise<void> => {
    return deleteApi(endpoints.deleteUnit(id));
  },

  // Master data operations - Tags
  getTags: async (): Promise<Tag[]> => {
    return get(endpoints.getTags);
  },

  createTag: async (name: string): Promise<Tag> => {
    return post(endpoints.createTag, { name });
  },

  updateTag: async (id: number, name: string): Promise<Tag> => {
    return patch(endpoints.updateTag(id), { name });
  },

  deleteTag: async (id: number): Promise<void> => {
    return deleteApi(endpoints.deleteTag(id));
  },
};
