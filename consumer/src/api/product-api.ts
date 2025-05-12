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
  
  // Variant operations
  getVariants: async (productId: number): Promise<ProductVariant[]> => {
    return get(endpoints.productVariants(productId));
  },
  
  createVariant: async (productId: number, variant: Omit<ProductVariant, 'id' | 'product_id'>): Promise<ProductVariant> => {
    return post(endpoints.productVariants(productId), variant);
  },
  
  updateVariant: async (variantId: number, variant: Partial<Omit<ProductVariant, 'id' | 'product_id'>>): Promise<ProductVariant> => {
    return patch(endpoints.updateVariant(variantId), variant);
  },
  
  deleteVariant: async (variantId: number): Promise<void> => {
    return deleteApi(endpoints.deleteVariant(variantId));
  },
  
  // Branch price operations
  getBranchPrices: async (productId: number): Promise<BranchPrice[]> => {
    return get(endpoints.productBranchPrices(productId));
  },
  
  createBranchPrice: async (productId: number, branchPrice: Omit<BranchPrice, 'id' | 'product_id'>): Promise<BranchPrice> => {
    return post(endpoints.productBranchPrices(productId), branchPrice);
  },
  
  updateBranchPrice: async (branchPriceId: number, branchPrice: Partial<Omit<BranchPrice, 'id' | 'product_id'>>): Promise<BranchPrice> => {
    return patch(endpoints.updateBranchPrice(branchPriceId), branchPrice);
  },
  
  deleteBranchPrice: async (branchPriceId: number): Promise<void> => {
    return deleteApi(endpoints.deleteBranchPrice(branchPriceId));
  },
  
  // Serial operations
  getSerials: async (productId: number): Promise<ProductSerial[]> => {
    return get(endpoints.productSerials(productId));
  },
  
  createSerial: async (productId: number, serial: string): Promise<ProductSerial> => {
    return post(endpoints.productSerials(productId), { serial });
  },
  
  updateSerial: async (serialId: number, serial: string): Promise<ProductSerial> => {
    return patch(endpoints.updateSerial(serialId), { serial });
  },
  
  deleteSerial: async (serialId: number): Promise<void> => {
    return deleteApi(endpoints.deleteSerial(serialId));
  },
  
  // Promotional price operations
  getPromotionalPrice: async (productId: number): Promise<PromotionalPrice | null> => {
    return get(endpoints.getPromotionalPrice(productId));
  },
  
  createPromotionalPrice: async (productId: number, promo: Omit<PromotionalPrice, 'id' | 'product_id'>): Promise<PromotionalPrice> => {
    return post(endpoints.getPromotionalPrice(productId), promo);
  },
  
  updatePromotionalPrice: async (productId: number, promo: Partial<Omit<PromotionalPrice, 'id' | 'product_id'>>): Promise<PromotionalPrice> => {
    return patch(endpoints.updatePromotionalPrice(productId), promo);
  },
  
  deletePromotionalPrice: async (productId: number): Promise<void> => {
    return deleteApi(endpoints.deletePromotionalPrice(productId));
  },
  
  // Tag operations
  getProductTags: async (productId: number): Promise<string[]> => {
    return get(endpoints.productTags(productId));
  },
  
  addProductTag: async (productId: number, tag: string): Promise<void> => {
    return post(endpoints.productTags(productId), { tag });
  },
  
  removeProductTag: async (productId: number, tagId: number): Promise<void> => {
    return deleteApi(`${endpoints.productTags(productId)}/${tagId}`);
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
  
  // Image upload
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    return post(endpoints.uploadImage, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};