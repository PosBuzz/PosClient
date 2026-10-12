import { useAuthStore } from "../../stores/authStore";
import { responseContract } from "../contracts/load";
export type AuthUser = NonNullable<
  ReturnType<typeof useAuthStore.getState>["user"]
>;
export const authUser: AuthUser = responseContract<{ user: AuthUser }>(
  "auth-client",
).user;
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
