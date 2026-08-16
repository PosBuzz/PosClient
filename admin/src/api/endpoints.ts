const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  "",
);
export const baseUrlWithPrefix = /\/api\/v1$/.test(apiBaseUrl)
  ? apiBaseUrl
  : `${apiBaseUrl}/api/v1`;
export const endpoints = {
  csrfToken: "/auth/csrf-token",
  login: "/auth/login-superadmin",
  getMe: "/auth/admin",
  logout: "/auth/admin-logout",
  refreshToken: "/auth/admin-refresh-token",
  consumer: "/admin/consumers",
  checkSubdomain: "/admin/consumers/check-subdomain",
  plan: "/admin/plans",
  user: "/admin/users",
  changePassword: "/admin/users/change-password",
  role: "/admin/users/roles",
  adminPermission: "/admin/users/permissions",
  billing: "/admin/billing",
  supportTickets: "/admin/support/tickets",
  supportTicketStats: "/admin/support/tickets/stats",
  supportTicket: (id: number) => `/admin/support/tickets/${id}`,
  supportTicketMessages: (id: number) => `/admin/support/tickets/${id}/messages`,
  backup: "/admin/backup",
  restore: "/admin/restore",
  downloadBillingInvoice: `${baseUrlWithPrefix}/admin/billing/invoice/pdf`,
  downloadBillingHistoryPDF: `${baseUrlWithPrefix}/admin/billing/history/pdf`,
  downloadBillingHistoryExcel: "/admin/billing/history/excel",
};
