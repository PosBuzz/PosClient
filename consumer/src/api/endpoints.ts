export const endpoints = {
  csrfToken: "/auth/csrf-token",
  login: "/auth/login-user",
  getMe: "/auth/client",
  logout: "/auth/client-logout",
  refreshToken: "/auth/client-refresh-token",
  changePassword: "/consumer/change-password",
  role: "/consumer/users/roles",
  user: "/consumer/users",
  planPermissions: "/consumer/users/plan-permissions",
  
  // Product management
  products: "/consumer/products",
  getProduct: (id: number) => `/consumer/products/${id}`,
  updateProduct: (id: number) => `/consumer/products/${id}`,
  deleteProduct: (id: number) => `/consumer/products/${id}`,
  
  // Master data endpoints
  getBrands: "/consumer/get-brands",
  getCategories: "/consumer/get-categories",
  getUnits: "/consumer/get-units",
  getBranches: "/consumer/get-branches",
  getTags: "/consumer/get-tags",
  
  // Create master data
  createBrand: "/consumer/create-brand",
  createCategory: "/consumer/create-category",
  createUnit: "/consumer/create-unit",
  createBranch: "/consumer/create-branch",
  createTag: "/consumer/create-tag",
  
  // Update master data
  updateBrand: (id: number) => `/consumer/brands/${id}`,
  updateCategory: (id: number) => `/consumer/categories/${id}`,
  updateUnit: (id: number) => `/consumer/units/${id}`,
  updateBranch: (id: number) => `/consumer/branches/${id}`,
  updateTag: (id: number) => `/consumer/tags/${id}`,
  
  // Delete master data
  deleteBrand: (id: number) => `/consumer/brands/${id}`,
  deleteCategory: (id: number) => `/consumer/categories/${id}`,
  deleteUnit: (id: number) => `/consumer/units/${id}`,
  deleteBranch: (id: number) => `/consumer/branches/${id}`,
  deleteTag: (id: number) => `/consumer/tags/${id}`,
};
