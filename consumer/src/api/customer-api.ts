import axiosInstance from "./axiosInstance";
import { Customer, CustomerListFilters } from "../types/customer.types";

export const customerApi = {
  // Get all customers with optional filters
  getAll: (filters?: CustomerListFilters) => {
    const params = new URLSearchParams();
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());
    if (filters?.search) params.append("search", filters.search);
    if (filters?.customer_type) params.append("customer_type", filters.customer_type);
    if (filters?.sort_by) params.append("sort_by", filters.sort_by);
    if (filters?.sort_order) params.append("sort_order", filters.sort_order);

    return axiosInstance.get(`/customers?${params.toString()}`);
  },

  // Get customer by ID
  getById: (id: number) => {
    return axiosInstance.get(`/customers/${id}`);
  },

  // Create new customer
  create: (customer: Omit<Customer, 'id' | 'consumer_id' | 'created_at' | 'updated_at'>) => {
    return axiosInstance.post("/customers", customer);
  },

  // Update customer
  update: (id: number, customer: Partial<Customer>) => {
    return axiosInstance.put(`/customers/${id}`, customer);
  },

  // Delete customer
  delete: (id: number) => {
    return axiosInstance.delete(`/customers/${id}`);
  },

  // Search customers
  search: (query: string) => {
    return axiosInstance.get(`/customers/search?q=${encodeURIComponent(query)}`);
  },
};
