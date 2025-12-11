import { Injectable, Logger } from '@nestjs/common';

/**
 * Centralized utility service for subdomain extraction and parsing
 * Used across guards, controllers, and services for consistency
 */
@Injectable()
export class SubdomainUtilService {
  private readonly logger = new Logger(SubdomainUtilService.name);
  private readonly excludedSubdomains = ['www', 'api', 'admin', 'app'];

  /**
   * Extract subdomain from a full URL or hostname
   * Handles: tenant.localhost, tenant.example.com, etc.
   * 
   * @param urlOrHost - Full URL or hostname string
   * @returns Extracted subdomain or null if not found/excluded
   */
  extractSubdomainFromUrl(urlOrHost: string): string | null {
    try {
      let hostname: string;

      // Try to parse as URL
      if (urlOrHost.startsWith('http://') || urlOrHost.startsWith('https://')) {
        const url = new URL(urlOrHost);
        hostname = url.hostname;
      } else {
        hostname = urlOrHost;
      }

      return this.extractSubdomainFromHost(hostname);
    } catch (error) {
      this.logger.error(`Error extracting subdomain from '${urlOrHost}':`, error);
      return null;
    }
  }

  /**
   * Extract subdomain from hostname
   * Handles:
   * - tenant.localhost -> tenant
   * - tenant.example.com -> tenant
   * - example.com -> null (no subdomain)
   * - localhost -> null
   * 
   * @param host - Hostname (may include port)
   * @returns Extracted subdomain or null
   */
  extractSubdomainFromHost(host: string): string | null {
    // Remove port if present
    const hostname = host.split(':')[0];

    // Split by dots
    const parts = hostname.split('.');

    // Need at least 2 parts for host like 'domain.tld' or 'tenant.localhost'
    if (parts.length < 2) {
      return null;
    }

    // Special-case: tenant.localhost (two parts) -> treat first part as subdomain
    if (parts.length === 2) {
      if (parts[1].toLowerCase() === 'localhost') {
        const candidate = parts[0];
        if (this.excludedSubdomains.includes(candidate.toLowerCase())) {
          return null;
        }
        return candidate.toLowerCase();
      }

      // For other two-part hosts (example.com) we treat as no subdomain
      return null;
    }

    // For 3+ parts, first is subdomain (tenant.example.com -> tenant)
    const subdomain = parts[0];

    // Exclude system subdomains
    if (this.excludedSubdomains.includes(subdomain.toLowerCase())) {
      return null;
    }

    return subdomain.toLowerCase();
  }

  /**
   * Extract subdomain from Express request object
   * Tries Origin header first, then Host header
   * 
   * @param request - Express Request object
   * @returns Extracted subdomain or null
   */
  extractSubdomainFromRequest(request: {
    headers: {
      origin?: string;
      host?: string;
      referer?: string;
    };
  }): string | null {
    // Try to get from Origin header first (for CORS requests)
    const origin = request.headers.origin;
    if (origin) {
      const subdomain = this.extractSubdomainFromUrl(origin);
      if (subdomain) return subdomain;
    }

    // Try Referer header as fallback
    const referer = request.headers.referer;
    if (referer) {
      const subdomain = this.extractSubdomainFromUrl(referer);
      if (subdomain) return subdomain;
    }

    // Fallback to Host header
    const host = request.headers.host;
    if (host) {
      return this.extractSubdomainFromHost(host);
    }

    return null;
  }

  /**
   * Check if a subdomain is in the excluded list
   * 
   * @param subdomain - Subdomain to check
   * @returns true if subdomain is excluded (www, api, admin, app)
   */
  isExcludedSubdomain(subdomain: string): boolean {
    return this.excludedSubdomains.includes(subdomain.toLowerCase());
  }

  /**
   * Get the list of excluded subdomains
   * 
   * @returns Array of excluded subdomain strings
   */
  getExcludedSubdomains(): string[] {
    return [...this.excludedSubdomains];
  }
}
