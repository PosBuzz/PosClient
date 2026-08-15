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
  role: string;
  permissions: string[];
};

interface AuthState {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
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
  isAuthenticated: false,
  isAuthLoading: true,
  user: null,
  csrfToken: null, // <-- INITIALLY null

  setUser: (user) => set({ user }),
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),
  setCsrfToken: (token) => set({ csrfToken: token }), // <-- SETTER

  login: async (email, password) => {
    await axiosInstance.post(endpoints.login, { email, password });
    // set({ isAuthenticated: true });
    await useAuthStore.getState().checkAuth();
  },

  logout: async () => {
    await axiosInstance.post(endpoints.logout);
    set({ isAuthenticated: false, user: null });
  },

  checkAuth: async () => {
    set({ isAuthLoading: true });
    try {
      const response = await axiosInstance.get(endpoints.getMe);
      set({ user: response.data?.user, isAuthenticated: true, isAuthLoading: false });
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
}));
