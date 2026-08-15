import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export const AuthLoader = () => {
  const {
    getCsrfToken,
    checkAuth,
    isAuthenticated,
    csrfToken,
    validateSubdomain,
    subdomainValidation,
  } = useAuthStore();
  const navigate = useNavigate();

  // First: Validate subdomain once on mount
  useEffect(() => {
    validateSubdomain();
  }, [validateSubdomain]);

  // Second: Handle routing based on subdomain validation status
  useEffect(() => {
    if (!subdomainValidation.checked) {
      // Still checking, wait...
      return;
    }

    // Subdomain validation complete - check results
    if (!subdomainValidation.exists) {
      // Subdomain doesn't exist in database - 404
      navigate("/404", { replace: true });
      return;
    }

    if (subdomainValidation.exists && !subdomainValidation.active) {
      // Subdomain exists but subscription inactive
      navigate("/inactive", { replace: true });
      return;
    }
  }, [subdomainValidation, navigate]);

  // Third: Get CSRF token after subdomain is validated
  useEffect(() => {
    if (subdomainValidation.checked && subdomainValidation.active) {
      getCsrfToken();
    }
  }, [subdomainValidation, getCsrfToken]);

  // Fourth: Check authentication only after CSRF token is ready
  useEffect(() => {
    if (
      subdomainValidation.checked &&
      subdomainValidation.active &&
      csrfToken
    ) {
      checkAuth();
    }
  }, [isAuthenticated, subdomainValidation, csrfToken, checkAuth]);

  return null;
};
