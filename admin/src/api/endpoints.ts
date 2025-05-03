export const getUrlForModel = (model: string, id: any = null) => {
  if (id) {
    return `crud/${id}?model=${model}`;
  }
  return `crud?model=${model}`;
};
export const baseUrlWithPrefix = `${import.meta.env.VITE_API_BASE_URL}/api/v1`;
export const API_CRUD_FIND_WHERE = "crud/find-where";

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
  backup: "/admin/backup",
  restore: "/admin/restore",
  downloadBillingHistory: `${baseUrlWithPrefix}/admin/billing/history`,
};
