// stores/authStore.ts
import { create } from "zustand";
import axiosInstance from "../api/axiosInstance";
import { endpoints } from "../api/endpoints";

type User = {
  id: number;
  role_id: number;
  email: string;
  name: string;
  refresh_token: string;
  created_by_id: number | null;
  company_name: string;
  company_email: string;
  secondary_email: string;
  logo: string;
  phone: string;
  address: string;
  role: string;
  permissions: string[];
  branches: Array<{
    id: number;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  }>;
};

interface SubdomainValidationState {
  checked: boolean;
  exists: boolean;
  active: boolean;
  subdomain: string | null;
  message: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  user: User | null;
  csrfToken: string | null;
  subdomainValidation: SubdomainValidationState;
  setUser: (user: User | null) => void;
  setAuthenticated: (auth: boolean) => void;
  setCsrfToken: (token: string | null) => void;
  setSubdomainValidation: (validation: SubdomainValidationState) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  getCsrfToken: () => Promise<void>;
  validateSubdomain: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isAuthLoading: true,
  user: null,
  csrfToken: null,
  subdomainValidation: {
    checked: false,
    exists: false,
    active: false,
    subdomain: null,
    message: null,
  },

  setUser: (user) => set({ user }),
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),
  setCsrfToken: (token) => set({ csrfToken: token }),
  setSubdomainValidation: (validation) =>
    set({ subdomainValidation: validation }),

  login: async (email, password) => {
    await axiosInstance.post(endpoints.login, { email, password });
    set({ isAuthenticated: true });
  },

  logout: async () => {
    await axiosInstance.post(endpoints.logout);
    set({ isAuthenticated: false, user: null });
  },

  checkAuth: async () => {
    set({ isAuthLoading: true });
    try {
      const response = await axiosInstance.get(endpoints.getMe);
      set({
        user: response.data?.user,
        isAuthenticated: true,
        isAuthLoading: false,
      });
    } catch {
      set({ isAuthenticated: false, user: null, isAuthLoading: false });
    }
  },

  getCsrfToken: async () => {
    try {
      const response = await axiosInstance.get(endpoints.csrfToken);
      const token = response.data?.csrfToken;
      if (token) {
        set({ csrfToken: token });
      }
    } catch (err) {
      console.error(err);
    }
  },

  validateSubdomain: async () => {
    try {
      // Extract subdomain from current hostname
      const hostname = window.location.hostname;
      const host = hostname.split(":")[0];
      const parts = host.split(".");

      // Check if we need subdomain validation
      let needsValidation = false;
      let currentSubdomain: string | null = null;

      // Handle localhost development (tenant.localhost)
      if (host === "localhost") {
        needsValidation = false;
      } else if (parts.length === 2 && parts[1].toLowerCase() === "localhost") {
        const candidate = parts[0];
        const excludedSubdomains = ["www", "api", "admin", "app"];
        if (
          candidate &&
          !excludedSubdomains.includes(candidate.toLowerCase())
        ) {
          needsValidation = true;
          currentSubdomain = candidate.toLowerCase();
        }
      } else if (parts.length >= 3) {
        const subdomain = parts[0];
        const excludedSubdomains = ["www", "api", "admin", "app"];
        if (!excludedSubdomains.includes(subdomain.toLowerCase())) {
          needsValidation = true;
          currentSubdomain = subdomain.toLowerCase();
        }
      }

      // If no subdomain, skip validation (admin or main site)
      if (!needsValidation) {
        set({
          subdomainValidation: {
            checked: true,
            exists: true,
            active: true,
            subdomain: null,
            message: "No subdomain validation required",
          },
        });
        return;
      }

      // Call backend validation endpoint
      const response = await axiosInstance.get(endpoints.validateSubdomain);

      // Handle 304 Not Modified or successful responses
      const data = response.data || response;

      if (data && typeof data === "object") {
        set({
          subdomainValidation: {
            checked: true,
            exists: data.exists || false,
            active: data.active || false,
            subdomain: data.subdomain || currentSubdomain,
            message: data.message || null,
          },
        });
      } else {
        // Fallback if response is malformed
        set({
          subdomainValidation: {
            checked: true,
            exists: false,
            active: false,
            subdomain: currentSubdomain,
            message: "Invalid response from server",
          },
        });
      }
    } catch (err) {
      console.error("Error validating subdomain:", err);
      set({
        subdomainValidation: {
          checked: true,
          exists: false,
          active: false,
          subdomain: null,
          message: "Error validating subdomain",
        },
      });
    }
  },
}));
