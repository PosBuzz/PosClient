// axiosInstance.ts
import axios from "axios";
import { endpoints } from "./endpoints";
import { useAuthStore } from "../stores/authStore";

const axiosInstance = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api/v1`,
  withCredentials: true,
});

// Dynamic CSRF Token injection before every request
axiosInstance.interceptors.request.use((config) => {
  const csrfToken = useAuthStore.getState().csrfToken; 
  
  if (csrfToken) {
    config.headers["X-CSRF-TOKEN"] = csrfToken;
  }

  return config;
});

// Separate instance for refresh token call
const refreshInstance = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api/v1`,
  withCredentials: true,
});

// Same for refreshInstance if needed
refreshInstance.interceptors.request.use((config) => {
  const csrfToken = useAuthStore.getState().csrfToken;

  if (csrfToken) {
    config.headers["X-CSRF-TOKEN"] = csrfToken;
  }

  return config;
});

// Response interceptor (your existing code)
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    
    // Handle CSRF token errors
    if (err.response?.status === 403 && 
        err.response?.data?.message === "invalid csrf token") {
      
      try {
        // Get a fresh CSRF token
        const response = await refreshInstance.get(endpoints.csrfToken);
        const newCsrfToken = response.data?.csrfToken;
        
        // Update store with new token
        useAuthStore.getState().setCsrfToken(newCsrfToken);
        
        // Retry the original request with new token
        originalRequest.headers["X-CSRF-TOKEN"] = newCsrfToken;
        return axiosInstance(originalRequest);
      } catch (csrfError) {
        return Promise.reject(csrfError);
      }
    }

    // Handle authentication errors (401)
    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Get the latest CSRF token
            const token = useAuthStore.getState().csrfToken;
            originalRequest.headers["X-CSRF-TOKEN"] = token;
            return axiosInstance(originalRequest);
          })
          .catch((error) => {
            return Promise.reject(error);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh the token
        await refreshInstance.post(endpoints.refreshToken);
        
        // Process all requests in the queue
        processQueue();
        
        return axiosInstance(originalRequest);
      } catch (refreshErr) {
        // If refresh fails, reject all queued requests
        processQueue(refreshErr);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default axiosInstance;
