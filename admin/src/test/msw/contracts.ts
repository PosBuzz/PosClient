import { useAuthStore } from "../../stores/authStore";
import { responseContract } from "../contracts/load";
export type AuthUser = NonNullable<
  ReturnType<typeof useAuthStore.getState>["user"]
>;
export const authUser = responseContract<{ user: AuthUser }>("auth-admin").user;
export const fixtures = {
  authAdmin: { user: authUser },
  csrf: { csrfToken: "test-csrf-token" },
};
