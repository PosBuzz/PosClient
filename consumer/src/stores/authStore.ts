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
  role: string;
  permissions: string[];
};

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  csrfToken: string | null; // <-- ADD THIS
  setUser: (user: User | null) => void;
  setAuthenticated: (auth: boolean) => void;
  setCsrfToken: (token: string | null) => void; // <-- ADD THIS
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  getCsrfToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: true,
  user: null,
  csrfToken: null, // <-- INITIALLY null

  setUser: (user) => set({ user }),
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),
  setCsrfToken: (token) => set({ csrfToken: token }), // <-- SETTER

  login: async (email, password) => {
    await axiosInstance.post(endpoints.login, { email, password });
    set({ isAuthenticated: true });
  },

  logout: async () => {
    await axiosInstance.post(endpoints.logout);
    set({ isAuthenticated: false, user: null });
  },

  checkAuth: async () => {
    try {
      const response = await axiosInstance.get(endpoints.getMe);
      set({ user: response.data?.user, isAuthenticated: true });
    } catch (err) {
      set({ isAuthenticated: false, user: null });
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
}));
