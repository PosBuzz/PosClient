import {
  Branch,
  Brand,
  Category,
  Product,
  ProductFormData,
  ProductListResponse,
  Tag,
  Unit,
} from "../types/product.types";
import axiosInstance from "./axiosInstance";
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
    // Convert arrays to comma-separated strings for the API
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.search) queryParams.append("search", params.search);

    // Convert number arrays to comma-separated strings
    if (params.categoryIds && params.categoryIds.length > 0) {
      queryParams.append("categoryIds", params.categoryIds.join(","));
    }
    if (params.brandIds && params.brandIds.length > 0) {
      queryParams.append("brandIds", params.brandIds.join(","));
    }
    if (params.tagIds && params.tagIds.length > 0) {
      queryParams.append("tagIds", params.tagIds.join(","));
    }

    const response = await axiosInstance.get(
      `/consumer/products?${queryParams.toString()}`
    );
    return response.data;
  },

  getProduct: async (id: number): Promise<Product> => {
    return get(endpoints.getProduct(id));
  },

  createProduct: async (productData: ProductFormData): Promise<Product> => {
    return post(endpoints.products, productData);
  },

  updateProduct: async (
    id: number,
    productData: Partial<ProductFormData>
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
