export const getUrlForModel = (model: string, id: any = null) => {
  if (id) {
    return `crud/${id}?model=${model}`;
  }
  return `crud?model=${model}`;
};

export const API_CRUD_FIND_WHERE = 'crud/find-where';

export const endpoints = {
  csrfToken: "/auth/csrf-token",
  login: "/auth/login-superadmin",
  getMe: "/auth/admin",
  logout: "/auth/admin-logout",
  refreshToken: "/auth/admin-refresh-token",
  consumer: "/admin/consumers",
  plan: "/admin/plans",
};
