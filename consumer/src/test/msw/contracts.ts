import { Permissions } from "../../constants/permissions";
import { useAuthStore } from "../../stores/authStore";
export type AuthUser = NonNullable<
  ReturnType<typeof useAuthStore.getState>["user"]
>;
// TEMP until B5 contracts/responses exists. These fixtures mirror the current auth envelope.
export const authUser: AuthUser = {
  id: 1,
  role_id: 1,
  email: "owner@example.test",
  name: "Test owner",
  refresh_token: "test-only",
  created_by_id: null,
  company_name: "Test shop",
  company_email: "shop@example.test",
  secondary_email: "",
  logo: "",
  phone: "",
  address: "",
  role: "Admin",
  permissions: Object.values(Permissions),
  branches: [{ id: 1, name: "Main" }],
};
export const fixtures = {
  authClient: { user: authUser },
  csrf: { csrfToken: "test-csrf-token" },
  subdomain: {
    exists: true,
    active: true,
    subdomain: "testshop",
    message: "Business is active",
  },
};
