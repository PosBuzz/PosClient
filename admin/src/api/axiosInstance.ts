// axiosInstance.ts
import axios from "axios";
import { endpoints } from "./endpoints";
import { useAuthStore } from "../stores/authStore";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// Dynamic CSRF Token injection before every request
axiosInstance.interceptors.request.use((config) => {
  const csrfToken = useAuthStore.getState().csrfToken; // <-- Access store without hook

  if (csrfToken) {
    config.headers["X-CSRF-TOKEN"] = csrfToken;
  }

  return config;
});

// Separate instance for refresh token call
const refreshInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
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

// Response interceptor
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

const isInvalidCsrfError = (err: any) => {
  return (
    err?.response?.status === 403 &&
    err?.response?.data?.message === "invalid csrf token"
  );
};

const refreshCsrfToken = async () => {
  const response = await refreshInstance.get(endpoints.csrfToken);
  const newCsrfToken = response.data?.csrfToken;
  useAuthStore.getState().setCsrfToken(newCsrfToken || null);
  return newCsrfToken;
};

const refreshAccessTokenWithCsrfRecovery = async () => {
  try {
    await refreshInstance.post(endpoints.refreshToken);
  } catch (refreshErr: any) {
    if (!isInvalidCsrfError(refreshErr)) {
      throw refreshErr;
    }

    const newCsrfToken = await refreshCsrfToken();
    if (!newCsrfToken) {
      throw refreshErr;
    }

    await refreshInstance.post(endpoints.refreshToken, null, {
      headers: {
        "X-CSRF-TOKEN": newCsrfToken,
      },
    });
  }
};

// Clears auth state and redirects to login when the refresh token is
// invalid or has already been rotated (token rotation invalidates old tokens).
const handleAuthFailure = () => {
  useAuthStore.getState().setAuthenticated(false);
  useAuthStore.getState().setUser(null);
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
};

axiosInstance.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (isInvalidCsrfError(err) && !originalRequest?._csrfRetried) {
      try {
        const newCsrfToken = await refreshCsrfToken();
        if (!newCsrfToken) {
          return Promise.reject(err);
        }

        originalRequest._csrfRetried = true;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers["X-CSRF-TOKEN"] = newCsrfToken;
        return axiosInstance(originalRequest);
      } catch (csrfError) {
        return Promise.reject(csrfError);
      }
    }

    // A 401 from the login request means wrong credentials, not an expired
    // session: let the login form show the server's message instead of refreshing.
    const isLoginRequest = originalRequest?.url === endpoints.login;
    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !isLoginRequest
    ) {
      // Another refresh is already in-flight — queue this request.
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Mark as retried so a 401 on this retry doesn't trigger another refresh.
            originalRequest._retry = true;
            originalRequest.headers = originalRequest.headers || {};
            const token = useAuthStore.getState().csrfToken;
            if (token) {
              originalRequest.headers["X-CSRF-TOKEN"] = token;
            }
            return axiosInstance(originalRequest);
          })
          .catch((error) => {
            return Promise.reject(error);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Token rotation: server invalidates the old refresh token and
        // issues a new one, so a replay of the old token will be rejected.
        await refreshAccessTokenWithCsrfRecovery();
        processQueue(); // resume all queued requests
        return axiosInstance(originalRequest);
      } catch (refreshErr) {
        // Refresh token is expired or already rotated — force logout.
        processQueue(refreshErr);
        handleAuthFailure();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  },
);

export default axiosInstance;
