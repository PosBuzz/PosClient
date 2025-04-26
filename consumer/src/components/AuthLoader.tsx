
import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

export const AuthLoader = () => {
  const { getCsrfToken, checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    getCsrfToken();
  }, []);

  useEffect(() => {
    checkAuth();
  }, [isAuthenticated]);

  return null;
};
