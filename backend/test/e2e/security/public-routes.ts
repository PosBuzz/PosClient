// Every route reachable without authentication. Adding to this list requires a reason.
export const PUBLIC_ROUTES: Record<string, string> = {
  'GET /api/v1': 'root hello',
  'GET /api/v1/health': 'load balancer health check',
  'GET /api/v1/metrics':
    'TODO-QUESTION: exposes DB pool metrics without authentication; confirm whether it should be network-restricted',
  'GET /api/v1/auth/csrf-token': 'bootstrap CSRF',
  'POST /api/v1/auth/login-user': 'login (throttled per IP + email)',
  'POST /api/v1/auth/login-superadmin': 'login (throttled per IP + email)',
  'POST /api/v1/auth/client-refresh-token':
    'refresh (validated by the refresh cookie)',
  'POST /api/v1/auth/admin-refresh-token':
    'refresh (validated by the refresh cookie)',
  'POST /api/v1/auth/client-logout':
    'logout (invalidates the supplied refresh cookie)',
  'POST /api/v1/auth/admin-logout':
    'logout (invalidates the supplied refresh cookie)',
  'GET /api/v1/public/subdomain/validate':
    'login page checks the tenant subdomain exists',
  'GET /api/v1/public/portfolio/content': 'marketing site content',
  'GET /api/v1/public/portfolio/demo-products': 'marketing site content',
  'GET /api/v1/public/portfolio/faqs': 'marketing site content',
  'GET /api/v1/public/portfolio/features': 'marketing site content',
  'GET /api/v1/public/portfolio/pricing-plans': 'marketing site content',
  'GET /api/v1/public/portfolio/settings': 'marketing site content',
  'GET /api/v1/public/portfolio/solutions': 'marketing site content',
  'GET /api/v1/public/portfolio/testimonials': 'marketing site content',
  'POST /api/v1/public/portfolio/leads':
    'marketing site contact form (ThrottlerGuard)',
};

// Client/admin-guarded routes that intentionally need no specific permission.
export const AUTH_ONLY_ROUTES: Record<string, string> = {
  'GET /api/v1/auth/client': 'current user',
  'GET /api/v1/auth/admin': 'current admin',
  'GET /api/v1/admin/consumers/check-subdomain':
    'availability check used while creating a consumer; reveals only taken/free',
  'POST /api/v1/ai/auto-description':
    'TODO-QUESTION: any signed-in user can call the AI gateway; confirm whether add_product/edit_product should be required',
  'POST /api/v1/ai/description-feedback':
    'TODO-QUESTION: same as auto-description',
  'GET /api/v1/consumer/import/status':
    'any signed-in user; reveals only whether bulk import is switched on',
  'POST /api/v1/consumer/import/:entity':
    'permission checked in the handler per entity (products: add_product, inventory: inventory_batches, customers: customers)',
  'GET /api/v1/consumer/import/:entity/columns':
    'permission checked in the handler per entity',
  'POST /api/v1/consumer/import/:entity/preview':
    'permission checked in the handler per entity',
  'GET /api/v1/consumer/import/:entity/template':
    'permission checked in the handler per entity',
};

// Routes that violate a rule today, with the KI that tracks them. BE-ROUTE-016 keeps this honest.
export const KNOWN_VIOLATIONS: Record<string, string> = {};
