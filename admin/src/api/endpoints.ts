export const getUrlForModel = (model: string, id: any = null) => {
  if (id) {
    return `crud/${id}?model=${model}`;
  }
  return `crud?model=${model}`;
};

export const endpoints = {
  login: "/auth/login-superadmin",
  getMe: "/auth/admin",
  logout: "/auth/admin-logout",
  refreshToken: "/auth/admin-refresh-token",
};
