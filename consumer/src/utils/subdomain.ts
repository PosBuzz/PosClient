/**
 * Subdomain Validation Utilities for Frontend
 * Simplified - backend extracts subdomain from Origin header automatically
 */

import React from "react";
import { get } from "../api/crud-api";
import { endpoints } from "../api/endpoints";

// Configure your API base URL

/**
 * Extract subdomain from current window location
 * @returns subdomain string or null if no subdomain
 * @example
 * // On tenant1.example.com
 * getSubdomain() // Returns: "tenant1"
 *
 * // On example.com
 * getSubdomain() // Returns: null
 */
export function getSubdomain(): string | null {
  const hostname = window.location.hostname;

  // Remove port if present
  const host = hostname.split(":")[0];

  // Split by dots
  const parts = host.split(".");
  // Handle localhost development (tenant.localhost)
  // NOTE: browsers resolve *.localhost to 127.0.0.1; this block must run
  // before the generic "parts.length < 3" check.
  if (host === "localhost") {
    // plain localhost (no subdomain)
    return null;
  }

  // tenant.localhost -> ['tenant','localhost']
  if (parts.length === 2 && parts[1].toLowerCase() === "localhost") {
    const candidate = parts[0];
    const excludedSubdomains = ["www", "api", "admin", "app"];
    if (!candidate || excludedSubdomains.includes(candidate.toLowerCase())) {
      return null;
    }
    return candidate.toLowerCase();
  }

  // For regular domains we need at least 3 parts: subdomain.domain.tld
  if (parts.length < 3) {
    return null;
  }

  // First part is the subdomain
  const subdomain = parts[0];

  // Exclude system subdomains
  const excludedSubdomains = ["www", "api", "admin", "app"];
  if (excludedSubdomains.includes(subdomain.toLowerCase())) {
    return null;
  }

  return subdomain.toLowerCase();
}

/**
 * Validate if the current subdomain exists and is active
 * Call this BEFORE showing the login page
 * Backend automatically extracts subdomain from Origin header - no params needed!
 * @returns Promise with validation result
 */
export async function validateSubdomain(): Promise<{
  success: boolean;
  exists: boolean;
  active?: boolean;
  subdomain?: string;
  message?: string;
}> {
  try {
    // Simple GET request - backend extracts subdomain from Origin header
    const response = await get(endpoints.validateSubdomain);

    return response.data;
  } catch (error) {
    console.error("Error validating subdomain:", error);
    return {
      success: false,
      exists: false,
      message: "Error validating subdomain",
    };
  }
}

/**
 * Check if current domain is a valid tenant subdomain
 * Use this on app initialization
 * @returns Promise<boolean> - true if valid, false otherwise
 */
export async function isValidTenantDomain(): Promise<boolean> {
  const subdomain = getSubdomain();

  if (!subdomain) {
    return false;
  }

  const result = await validateSubdomain();
  return result.success && result.exists && result.active === true;
}

/**
 * React Hook for subdomain validation
 * Use this in your App.tsx or router configuration
 */
export function useSubdomainValidation() {
  const [isValidating, setIsValidating] = React.useState(true);
  const [isValid, setIsValid] = React.useState(false);
  const [subdomain, setSubdomain] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function validate() {
      const currentSubdomain = getSubdomain();
      setSubdomain(currentSubdomain);

      if (!currentSubdomain) {
        setError("No subdomain found");
        setIsValid(false);
        setIsValidating(false);
        return;
      }

      try {
        // Backend automatically extracts subdomain from Origin header
        const result = await validateSubdomain();

        if (!result.success) {
          setError(result.message || "Invalid subdomain");
          setIsValid(false);
        } else if (!result.active) {
          setError("Tenant subscription is not active");
          setIsValid(false);
        } else {
          setIsValid(true);
          setError(null);
        }
      } catch {
        setError("Failed to validate subdomain");
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    }

    validate();
  }, []);

  return { isValidating, isValid, subdomain, error };
}
