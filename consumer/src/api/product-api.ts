import { get, post, patch, deleteApi } from "./crud-api";
import { endpoints } from "./endpoints";
import {
  ProductFormValues,
  Product,
  ProductListParams,
  ProductListResponse,
  Category,
  Brand,
  Unit,
  Branch,
  Tag,
  ProductVariant,
  BranchPrice,
  ProductSerial,
  PromotionalPrice,
} from "../types/product.types";

export const productApi = {
  // Product CRUD operations
  getProducts: async (params?: ProductListParams): Promise<ProductListResponse> => {
    return get(endpoints.products, { params });
  },
  
  getProduct: async (id: number): Promise<Product> => {
    return get(endpoints.getProduct(id));
  },
  
  createProduct: async (productData: ProductFormValues): Promise<Product> => {
    return post(endpoints.products, productData);
  },
  
  updateProduct: async (id: number, productData: Partial<ProductFormValues>): Promise<Product> => {
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
  
  // Master data operations - Branches
  getBranches: async (): Promise<Branch[]> => {
    return get(endpoints.getBranches);
  },
  
  createBranch: async (name: string): Promise<Branch> => {
    return post(endpoints.createBranch, { name });
  },
  
  updateBranch: async (id: number, name: string): Promise<Branch> => {
    return patch(endpoints.updateBranch(id), { name });
  },
  
  deleteBranch: async (id: number): Promise<void> => {
    return deleteApi(endpoints.deleteBranch(id));
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