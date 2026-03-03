import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

export const AuthLoader = () => {
  const { getCsrfToken, checkAuth } = useAuthStore();

  // useEffect(() => {
  //   getCsrfToken();
  // }, []);

  // useEffect(() => {
  //   checkAuth();
  // }, [isAuthenticated]);

  useEffect(() => {
    const init = async () => {
      await getCsrfToken();
      await checkAuth();
    };
    init();
  }, []);

  return null;
};
